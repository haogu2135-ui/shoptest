package com.example.shop.repository;

import com.example.shop.entity.ProductQuestion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ProductQuestionRepository extends JpaRepository<ProductQuestion, Long> {
    @Query("select q from ProductQuestion q "
            + "join fetch q.product p "
            + "join fetch q.user u "
            + "where p.id = :productId "
            + "and q.answer is not null and trim(q.answer) <> '' "
            + "order by q.answeredAt desc, q.createdAt desc, q.id desc")
    List<ProductQuestion> findAnsweredByProductId(@Param("productId") Long productId, Pageable pageable);

    @Query("select q from ProductQuestion q "
            + "left join fetch q.product p "
            + "left join fetch q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "order by case when q.answer is null or trim(q.answer) = '' then 0 else 1 end, q.createdAt desc, q.id desc")
    List<ProductQuestion> findAdminQueue(@Param("answered") Boolean answered, Pageable pageable);

    @Query("select q from ProductQuestion q "
            + "left join fetch q.product p "
            + "left join fetch q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "and (:search is null or :search = '' "
            + "or lower(coalesce(q.question, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(q.answer, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(p.name, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(u.username, '')) like concat('%', :search, '%') "
            + "or str(q.id) like concat('%', :search, '%') "
            + "or str(p.id) like concat('%', :search, '%') "
            + "or str(u.id) like concat('%', :search, '%')) "
            + "order by case when q.answer is null or trim(q.answer) = '' then 0 else 1 end, q.createdAt desc, q.id desc")
    List<ProductQuestion> findAdminQueue(@Param("answered") Boolean answered,
                                         @Param("search") String search,
                                         Pageable pageable);

    @Query("select count(q) from ProductQuestion q")
    long countAllQuestions();

    @Query("select count(q) from ProductQuestion q where q.answer is null or trim(q.answer) = ''")
    long countUnansweredQuestions();

    @Query("select count(q) from ProductQuestion q where q.answer is not null and trim(q.answer) <> ''")
    long countAnsweredQuestions();

    @Query("select count(q) from ProductQuestion q where (q.answer is null or trim(q.answer) = '') and q.createdAt < :staleBefore")
    long countStaleUnansweredQuestions(@Param("staleBefore") LocalDateTime staleBefore);

    @Query("select count(q) from ProductQuestion q "
            + "left join q.product p "
            + "left join q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "and (:search is null or :search = '' "
            + "or lower(coalesce(q.question, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(q.answer, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(p.name, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(u.username, '')) like concat('%', :search, '%') "
            + "or str(q.id) like concat('%', :search, '%') "
            + "or str(p.id) like concat('%', :search, '%') "
            + "or str(u.id) like concat('%', :search, '%'))")
    long countAdminQuestions(@Param("answered") Boolean answered, @Param("search") String search);

    @Query("select count(q) from ProductQuestion q "
            + "left join q.product p "
            + "left join q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "and (q.answer is null or trim(q.answer) = '') "
            + "and (:search is null or :search = '' "
            + "or lower(coalesce(q.question, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(q.answer, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(p.name, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(u.username, '')) like concat('%', :search, '%') "
            + "or str(q.id) like concat('%', :search, '%') "
            + "or str(p.id) like concat('%', :search, '%') "
            + "or str(u.id) like concat('%', :search, '%'))")
    long countAdminUnansweredQuestions(@Param("answered") Boolean answered, @Param("search") String search);

    @Query("select count(q) from ProductQuestion q "
            + "left join q.product p "
            + "left join q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "and q.answer is not null and trim(q.answer) <> '' "
            + "and (:search is null or :search = '' "
            + "or lower(coalesce(q.question, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(q.answer, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(p.name, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(u.username, '')) like concat('%', :search, '%') "
            + "or str(q.id) like concat('%', :search, '%') "
            + "or str(p.id) like concat('%', :search, '%') "
            + "or str(u.id) like concat('%', :search, '%'))")
    long countAdminAnsweredQuestions(@Param("answered") Boolean answered, @Param("search") String search);

    @Query("select count(q) from ProductQuestion q "
            + "left join q.product p "
            + "left join q.user u "
            + "where (:answered is null "
            + "or (:answered = true and q.answer is not null and trim(q.answer) <> '') "
            + "or (:answered = false and (q.answer is null or trim(q.answer) = ''))) "
            + "and (q.answer is null or trim(q.answer) = '') "
            + "and q.createdAt < :staleBefore "
            + "and (:search is null or :search = '' "
            + "or lower(coalesce(q.question, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(q.answer, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(p.name, '')) like concat('%', :search, '%') "
            + "or lower(coalesce(u.username, '')) like concat('%', :search, '%') "
            + "or str(q.id) like concat('%', :search, '%') "
            + "or str(p.id) like concat('%', :search, '%') "
            + "or str(u.id) like concat('%', :search, '%'))")
    long countAdminStaleUnansweredQuestions(@Param("answered") Boolean answered,
                                            @Param("search") String search,
                                            @Param("staleBefore") LocalDateTime staleBefore);
}
